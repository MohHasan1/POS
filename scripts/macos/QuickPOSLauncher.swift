import AppKit
import Darwin

@MainActor
final class QuickPOSLauncher: NSObject, NSApplicationDelegate {
    private let server: LocalServer
    private let headless: Bool
    private var startup: Task<Void, Never>?
    private var quitting = false
    private var stopped = false
    private var signals: [DispatchSourceSignal] = []

    init(installation: Installation, headless: Bool) {
        server = LocalServer(installation: installation)
        self.headless = headless
    }

    func applicationDidFinishLaunching(_ notification: Notification) {
        if !headless {
            NSApp.mainMenu = NSMenu()
            let item = NSMenuItem()
            item.submenu = appMenu()
            NSApp.mainMenu?.addItem(item)
        }

        for number in [SIGINT, SIGTERM] {
            Darwin.signal(number, SIG_IGN)
            let source = DispatchSource.makeSignalSource(signal: number, queue: .main)
            source.setEventHandler { [weak self] in self?.quit() }
            source.resume()
            signals.append(source)
        }

        server.onExit = { [weak self] status in
            guard let self else { return }
            if self.headless, status == 0 {
                self.quit()
            } else {
                Task {
                    await self.server.stop()
                    self.report(LauncherError("The QuickPOS server stopped (exit status \(status)). See server.log for details."))
                }
            }
        }

        startup = Task {
            do {
                try await server.start()
                if headless, let url = server.readyURL {
                    print(url.absoluteString)
                    fflush(stdout)
                } else {
                    openQuickPOS()
                }
            } catch is CancellationError {
                return
            } catch {
                await server.stop()
                report(error)
            }
        }
    }

    func applicationShouldHandleReopen(_ sender: NSApplication, hasVisibleWindows: Bool) -> Bool {
        openQuickPOS()
        return true
    }

    func applicationDockMenu(_ sender: NSApplication) -> NSMenu? {
        appMenu(keyEquivalents: false)
    }

    func applicationShouldTerminate(_ sender: NSApplication) -> NSApplication.TerminateReply {
        if stopped { return .terminateNow }

        quit()
        return .terminateCancel
    }

    @objc private func quit() {
        guard !quitting else { return }
        quitting = true
        startup?.cancel()
        // Finish asynchronous cleanup before asking AppKit to terminate.
        Task {
            await startup?.value
            await server.stop()
            stopped = true
            if headless { exit(0) }
            NSApp.terminate(nil)
        }
    }

    @objc private func openQuickPOS() {
        guard !headless, !quitting, let url = server.readyURL else { return }
        NSWorkspace.shared.open(url)
    }

    @objc private func openLogs() {
        NSWorkspace.shared.open(server.installation.logs)
    }

    private func appMenu(keyEquivalents: Bool = true) -> NSMenu {
        let menu = NSMenu(title: "QuickPOS")
        let browser = menu.addItem(withTitle: "Open QuickPOS", action: #selector(openQuickPOS),
                                   keyEquivalent: keyEquivalents ? "o" : "")
        browser.target = self
        let logs = menu.addItem(withTitle: "Open Logs", action: #selector(openLogs), keyEquivalent: "")
        logs.target = self
        if keyEquivalents {
            menu.addItem(.separator())
            let quit = menu.addItem(withTitle: "Quit QuickPOS", action: #selector(quit), keyEquivalent: "q")
            quit.target = self
        }
        return menu
    }

    private func report(_ error: Error) {
        guard !quitting else { return }
        let message = error.localizedDescription
        server.installation.log(message)
        if headless {
            fputs("QuickPOS: \(message)\n", stderr)
            exit(1)
        }

        NSApp.activate(ignoringOtherApps: true)
        let alert = NSAlert()
        alert.messageText = "QuickPOS stopped"
        alert.informativeText = message
        alert.alertStyle = .warning
        alert.addButton(withTitle: "Open Logs")
        alert.addButton(withTitle: "Quit")
        if alert.runModal() == .alertFirstButtonReturn { openLogs() }
        quit()
    }
}

@main
@MainActor
enum QuickPOS {
    static func main() {
        umask(0o077)
        let headless = CommandLine.arguments.contains("--headless")
        let root: URL
        if headless, let testDirectory = ProcessInfo.processInfo.environment["QUICKPOS_MAC_TEST_DATA_DIR"] {
            root = URL(fileURLWithPath: testDirectory, isDirectory: true)
        } else {
            root = FileManager.default.homeDirectoryForCurrentUser
                .appendingPathComponent("Library/Application Support/QuickPOS", isDirectory: true)
        }

        guard let resources = Bundle.main.resourceURL else {
            fputs("QuickPOS must run from its application bundle.\n", stderr)
            exit(1)
        }
        let installation = Installation(root: root, resources: resources,
                                        version: Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "unknown")
        let app = NSApplication.shared
        let launcher = QuickPOSLauncher(installation: installation, headless: headless)
        app.setActivationPolicy(headless ? .prohibited : .regular)
        app.delegate = launcher
        app.run()
    }
}
