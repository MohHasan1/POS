import Foundation
import Security
import SQLite3

struct LauncherError: LocalizedError {
    let message: String

    init(_ message: String) {
        self.message = message
    }

    var errorDescription: String? { message }
}

struct Installation {
    struct Configuration: Codable {
        let port: Int
    }

    struct Instance: Codable {
        let port: Int
        let shutdownToken: String
    }

    let root: URL
    let resources: URL
    let version: String

    var server: URL { resources.appendingPathComponent("server", isDirectory: true) }
    var node: URL { resources.appendingPathComponent("runtime/node") }
    var data: URL { root.appendingPathComponent("data", isDirectory: true) }
    var media: URL { data.appendingPathComponent("media", isDirectory: true) }
    var database: URL { data.appendingPathComponent("pos.db") }
    var backups: URL { root.appendingPathComponent("backups", isDirectory: true) }
    var logs: URL { root.appendingPathComponent("logs", isDirectory: true) }
    var run: URL { root.appendingPathComponent("run", isDirectory: true) }
    var instance: URL { run.appendingPathComponent("instance.json") }

    private var files: FileManager { .default }

    func prepareDirectories() throws {
        for directory in [root, data, media, backups, logs, run] {
            try files.createDirectory(
                at: directory,
                withIntermediateDirectories: true,
                attributes: [.posixPermissions: 0o700]
            )
        }
    }

    func readPort() throws -> Int {
        let url = root.appendingPathComponent("config.json")
        if !files.fileExists(atPath: url.path) {
            try writeJSON(Configuration(port: 3210), to: url)
        }

        guard let config = try? JSONDecoder().decode(Configuration.self, from: Data(contentsOf: url)),
              (1024...65535).contains(config.port)
        else {
            throw LauncherError("Set a port from 1024 through 65535 in \(url.path), then reopen QuickPOS.")
        }
        return config.port
    }

    func payloadSecret() throws -> String {
        let url = data.appendingPathComponent("payload-secret")
        if !files.fileExists(atPath: url.path) {
            try Data(randomToken().utf8).write(to: url, options: .withoutOverwriting)
        }
        try files.setAttributes([.posixPermissions: 0o600], ofItemAtPath: url.path)
        let secret = try String(contentsOf: url, encoding: .utf8)
            .trimmingCharacters(in: .newlines)
        guard !secret.trimmingCharacters(in: .whitespaces).isEmpty else {
            throw LauncherError("The saved QuickPOS secret is empty. Restore it from your original installation.")
        }
        return secret
    }

    func randomToken() throws -> String {
        var bytes = [UInt8](repeating: 0, count: 32)
        guard SecRandomCopyBytes(kSecRandomDefault, bytes.count, &bytes) == errSecSuccess else {
            throw LauncherError("macOS could not generate a secure QuickPOS token.")
        }
        return bytes.map { String(format: "%02x", $0) }.joined()
    }

    func readInstance() throws -> Instance? {
        guard files.fileExists(atPath: instance.path) else { return nil }
        let value = try JSONDecoder().decode(Instance.self, from: Data(contentsOf: instance))
        guard (1024...65535).contains(value.port), value.shutdownToken.count == 64 else {
            throw LauncherError("QuickPOS could not read the saved server state. See the logs for details.")
        }
        return value
    }

    func writeInstance(_ value: Instance) throws {
        try writeJSON(value, to: instance)
    }

    func removeInstance() {
        try? files.removeItem(at: instance)
    }

    func openServerLog() throws -> FileHandle {
        let url = logs.appendingPathComponent("server.log")
        if !files.fileExists(atPath: url.path) {
            try Data().write(to: url)
            try files.setAttributes([.posixPermissions: 0o600], ofItemAtPath: url.path)
        }
        let handle = try FileHandle(forWritingTo: url)
        try handle.seekToEnd()
        return handle
    }

    func log(_ message: String) {
        let url = logs.appendingPathComponent("launcher.log")
        let line = Data("\(Date().ISO8601Format()) \(message)\n".utf8)
        if let handle = try? FileHandle(forWritingTo: url) {
            defer { try? handle.close() }
            _ = try? handle.seekToEnd()
            try? handle.write(contentsOf: line)
        } else {
            try? line.write(to: url, options: .withoutOverwriting)
        }
    }

    func prepareDatabase() throws {
        guard files.fileExists(atPath: database.path) else { return }
        let size = try database.resourceValues(forKeys: [.fileSizeKey]).fileSize ?? 0
        guard size > 0 else { return }

        let databaseCopy = try DatabaseFile(url: database, flags: SQLITE_OPEN_READONLY)
        let time = Date().ISO8601Format().replacingOccurrences(of: ":", with: "")
        let backup = backups.appendingPathComponent("pre-migration-\(time)-\(UUID().uuidString.prefix(8))")
        let temporaryBackup = backups.appendingPathComponent(".\(backup.lastPathComponent)")
        try files.createDirectory(at: temporaryBackup, withIntermediateDirectories: false)
        defer { try? files.removeItem(at: temporaryBackup) }

        try databaseCopy.backup(to: temporaryBackup.appendingPathComponent("pos.db"))
        try files.copyItem(at: media, to: temporaryBackup.appendingPathComponent("media"))
        try writeJSON(["version": version, "createdAt": Date().ISO8601Format()],
                      to: temporaryBackup.appendingPathComponent("backup.json"))
        try files.moveItem(at: temporaryBackup, to: backup)
        log("Created database and media backup \(backup.lastPathComponent).")

        let saved = try files.contentsOfDirectory(at: backups, includingPropertiesForKeys: nil)
            .filter { $0.lastPathComponent.hasPrefix("pre-migration-") && $0 != backup }
            .sorted { $0.lastPathComponent > $1.lastPathComponent }
        for obsolete in saved.dropFirst(9) {
            try? files.removeItem(at: obsolete)
        }

        if try databaseCopy.containsRow("SELECT 1 FROM sqlite_master WHERE type='table' AND name='payload_migrations'"),
           try databaseCopy.containsRow("SELECT 1 FROM payload_migrations WHERE batch = -1") {
            throw LauncherError("This database came from Payload development mode. Prepare a reconciled copy using the Mac transfer guide, then reopen QuickPOS.")
        }
    }

    private func writeJSON<Value: Encodable>(_ value: Value, to url: URL) throws {
        try JSONEncoder().encode(value).write(to: url, options: .atomic)
        try files.setAttributes([.posixPermissions: 0o600], ofItemAtPath: url.path)
    }
}

private final class DatabaseFile {
    private let handle: OpaquePointer

    init(url: URL, flags: Int32) throws {
        var opened: OpaquePointer?
        let status = sqlite3_open_v2(url.path, &opened, flags, nil)
        guard status == SQLITE_OK, let opened else {
            sqlite3_close(opened)
            throw LauncherError("Could not open the QuickPOS database at \(url.path).")
        }
        handle = opened
        sqlite3_busy_timeout(handle, 5_000)
    }

    deinit {
        sqlite3_close(handle)
    }

    func containsRow(_ sql: String) throws -> Bool {
        var statement: OpaquePointer?
        guard sqlite3_prepare_v2(handle, sql, -1, &statement, nil) == SQLITE_OK else {
            throw LauncherError("Could not read the QuickPOS migration history.")
        }
        defer { sqlite3_finalize(statement) }

        switch sqlite3_step(statement) {
        case SQLITE_ROW: return true
        case SQLITE_DONE: return false
        default: throw LauncherError("Could not read the QuickPOS migration history.")
        }
    }

    func backup(to url: URL) throws {
        let destination = try DatabaseFile(url: url, flags: SQLITE_OPEN_READWRITE | SQLITE_OPEN_CREATE)
        guard let snapshot = sqlite3_backup_init(destination.handle, "main", handle, "main") else {
            throw LauncherError("Could not prepare the QuickPOS database backup.")
        }
        let status = sqlite3_backup_step(snapshot, -1)
        let finish = sqlite3_backup_finish(snapshot)
        guard status == SQLITE_DONE, finish == SQLITE_OK else {
            throw LauncherError("Could not save a consistent QuickPOS database backup.")
        }
    }
}
