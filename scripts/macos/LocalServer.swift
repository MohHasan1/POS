import Darwin
import Foundation

@MainActor
final class LocalServer {
    private static let startupTimeout: TimeInterval = 120

    let installation: Installation
    private var lock: Int32?
    private var child: Process?
    private var output: FileHandle?
    private var instance: Installation.Instance?
    private var stopping = false
    private(set) var readyURL: URL?
    var onExit: ((Int32) -> Void)?

    private let session: URLSession = {
        let config = URLSessionConfiguration.ephemeral
        config.timeoutIntervalForRequest = 2
        config.timeoutIntervalForResource = 2
        config.connectionProxyDictionary = [:]
        return URLSession(configuration: config)
    }()

    init(installation: Installation) {
        self.installation = installation
    }

    func start() async throws {
        try installation.prepareDirectories()
        try takeLock()
        if let previous = try installation.readInstance() {
            try await recover(previous)
        }

        let port = try installation.readPort()
        guard Self.portIsAvailable(port) else {
            throw LauncherError("Port \(port) is in use. Quit the other app or change the port in \(installation.root.appendingPathComponent("config.json").path).")
        }

        let installation = self.installation
        try await Task.detached(priority: .utility) { try installation.prepareDatabase() }.value
        try Task.checkCancellation()

        let secret = try installation.payloadSecret()
        let instance = try Installation.Instance(port: port, shutdownToken: installation.randomToken())
        let process = Process()
        process.executableURL = installation.node
        process.arguments = [installation.server.appendingPathComponent("server.js").path]
        process.currentDirectoryURL = installation.server
        process.environment = [
            "DATABASE_ADAPTER": "sqlite",
            "DATABASE_URL": installation.database.absoluteString,
            "HOSTNAME": "127.0.0.1",
            "NEXT_TELEMETRY_DISABLED": "1",
            "NODE_ENV": "production",
            "PAYLOAD_SECRET": secret,
            "PORT": String(port),
            "QUICKPOS_DESKTOP": "1",
            "QUICKPOS_MEDIA_DIR": installation.media.path,
            "QUICKPOS_MIGRATE_ON_STARTUP": "1",
            "QUICKPOS_SCHEMA_PUSH": "0",
            "QUICKPOS_SHUTDOWN_TOKEN": instance.shutdownToken,
        ]
        let output = try installation.openServerLog()
        self.output = output
        process.standardInput = FileHandle.nullDevice
        process.standardOutput = output
        process.standardError = output
        process.terminationHandler = { [weak self] process in
            guard let server = self else { return }
            let status = process.terminationStatus
            Task { @MainActor in
                guard server.readyURL != nil, !server.stopping else { return }
                server.readyURL = nil
                server.onExit?(status)
            }
        }

        try installation.writeInstance(instance)
        self.instance = instance
        try process.run()
        child = process
        let url = Self.url(port)
        let deadline = Date().addingTimeInterval(Self.startupTimeout)
        while Date() < deadline {
            try Task.checkCancellation()
            guard process.isRunning else {
                throw LauncherError("The QuickPOS server stopped during startup. See server.log for details.")
            }
            if let (data, status) = await request(url.appendingPathComponent("api/quickpos/health")) {
                if status == 503 {
                    throw LauncherError("QuickPOS could not prepare the database. See server.log for details.")
                }
                if status == 200,
                   let health = try? JSONDecoder().decode(Health.self, from: data),
                   health.app == "QuickPOS", health.status == "ok", health.database == "ready",
                   process.isRunning {
                    try Task.checkCancellation()
                    readyURL = url
                    installation.log("QuickPOS \(installation.version) is ready at \(url.absoluteString).")
                    return
                }
            }
            try await Task.sleep(nanoseconds: 300_000_000)
        }
        throw LauncherError("QuickPOS did not become ready within \(Int(Self.startupTimeout)) seconds. See server.log for details.")
    }

    func stop() async {
        stopping = true
        readyURL = nil

        if let child, child.isRunning {
            if let instance {
                _ = await shutdown(instance)
                await waitForExit(child, seconds: 5)
            }
            if child.isRunning {
                child.terminate()
                await waitForExit(child, seconds: 3)
            }
            if child.isRunning {
                kill(child.processIdentifier, SIGKILL)
                await waitForExit(child, seconds: 2)
            }
        }

        if child?.isRunning != true, instance != nil {
            installation.removeInstance()
        }
        if lock != nil {
            installation.log(child?.isRunning == true ? "QuickPOS server could not be stopped." : "QuickPOS stopped.")
        }
        instance = nil
        child = nil
        try? output?.close()
        output = nil
        if let lock { close(lock) }
        lock = nil
    }

    private struct Health: Decodable {
        let app: String
        let database: String
        let status: String
    }

    private func takeLock() throws {
        let path = installation.run.appendingPathComponent("instance.lock").path
        let descriptor = open(path, O_RDWR | O_CREAT | O_CLOEXEC, 0o600)
        guard descriptor >= 0 else {
            throw LauncherError("QuickPOS could not open its instance lock. Check access to Application Support.")
        }
        guard flock(descriptor, LOCK_EX | LOCK_NB) == 0 else {
            close(descriptor)
            throw LauncherError("QuickPOS is already running for this data folder.")
        }
        lock = descriptor
    }

    private func recover(_ previous: Installation.Instance) async throws {
        if !Self.portIsAvailable(previous.port) {
            guard await shutdown(previous) else {
                throw LauncherError("Port \(previous.port) is in use. QuickPOS could not verify ownership of the server on that port.")
            }
            let deadline = Date().addingTimeInterval(5)
            while !Self.portIsAvailable(previous.port), Date() < deadline {
                try await Task.sleep(nanoseconds: 200_000_000)
            }
            guard Self.portIsAvailable(previous.port) else {
                throw LauncherError("The previous QuickPOS server is still stopping. Try opening the app again.")
            }
        }
        installation.removeInstance()
    }

    private func shutdown(_ instance: Installation.Instance) async -> Bool {
        let url = Self.url(instance.port).appendingPathComponent("api/quickpos/shutdown")
        return await request(url, shutdownToken: instance.shutdownToken)?.1 == 200
    }

    private func request(_ url: URL, shutdownToken: String? = nil) async -> (Data, Int)? {
        var request = URLRequest(url: url)
        if let shutdownToken {
            request.httpMethod = "POST"
            request.setValue(shutdownToken, forHTTPHeaderField: "x-quickpos-shutdown-token")
        }
        guard let (data, response) = try? await session.data(for: request),
              let response = response as? HTTPURLResponse, response.url == url else { return nil }
        return (data, response.statusCode)
    }

    private func waitForExit(_ process: Process, seconds: TimeInterval) async {
        let deadline = Date().addingTimeInterval(seconds)
        while process.isRunning, Date() < deadline {
            await withCheckedContinuation { continuation in
                DispatchQueue.global().asyncAfter(deadline: .now() + 0.1) { continuation.resume() }
            }
        }
    }

    private static func url(_ port: Int) -> URL {
        URL(string: "http://127.0.0.1:\(port)/")!
    }

    private static func portIsAvailable(_ port: Int) -> Bool {
        let descriptor = socket(AF_INET, SOCK_STREAM, 0)
        guard descriptor >= 0 else { return false }
        defer { close(descriptor) }

        var reuse: Int32 = 1
        _ = setsockopt(descriptor, SOL_SOCKET, SO_REUSEADDR, &reuse, socklen_t(MemoryLayout<Int32>.size))
        var address = sockaddr_in()
        address.sin_len = UInt8(MemoryLayout<sockaddr_in>.size)
        address.sin_family = sa_family_t(AF_INET)
        address.sin_port = UInt16(port).bigEndian
        address.sin_addr.s_addr = inet_addr("127.0.0.1")
        return withUnsafePointer(to: &address) { pointer in
            pointer.withMemoryRebound(to: sockaddr.self, capacity: 1) {
                bind(descriptor, $0, socklen_t(MemoryLayout<sockaddr_in>.size)) == 0
            }
        }
    }
}
