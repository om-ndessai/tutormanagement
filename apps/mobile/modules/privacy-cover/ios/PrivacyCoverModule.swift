// The app-switcher cover (docs/mobile/ux-audit.md F-1, immersive-design.md §13): while the app is
// not the active one, a window in the brand's colours sits over every other window of the scene,
// so the snapshot iOS writes for the app switcher (and keeps on disk) shows no money, notes or
// names. A window of its own, above alerts, covers presented form sheets too (the payment form,
// the 1099). It is shown synchronously from the resign-active notification on the main thread,
// before iOS takes the snapshot -- which a React render cannot promise.
import ExpoModulesCore
import UIKit

public final class PrivacyCoverModule: Module {
  private var enabled = false
  private var background: UIColor = .systemBackground
  private var tint: UIColor = .label
  private var coverWindow: UIWindow?
  private var observers: [NSObjectProtocol] = []

  public func definition() -> ModuleDefinition {
    Name("PrivacyCover")

    OnDestroy {
      DispatchQueue.main.async {
        self.stopObserving()
        self.hideCover()
      }
    }

    /// Turns the cover on (or recolours it): `background` fills the screen, `tint` the lock.
    Function("enable") { (background: UIColor, tint: UIColor) in
      DispatchQueue.main.async {
        self.background = background
        self.tint = tint
        if !self.enabled {
          self.enabled = true
          self.startObserving()
        }
      }
    }

    Function("disable") {
      DispatchQueue.main.async {
        self.enabled = false
        self.stopObserving()
        self.hideCover()
      }
    }
  }

  private func startObserving() {
    let center = NotificationCenter.default
    let show: (Notification) -> Void = { [weak self] _ in self?.showCover() }
    let hide: (Notification) -> Void = { [weak self] _ in self?.hideCover() }
    observers = [
      center.addObserver(forName: UIApplication.willResignActiveNotification, object: nil, queue: .main, using: show),
      center.addObserver(forName: UIScene.willDeactivateNotification, object: nil, queue: .main, using: show),
      center.addObserver(forName: UIApplication.didEnterBackgroundNotification, object: nil, queue: .main, using: show),
      center.addObserver(forName: UIApplication.didBecomeActiveNotification, object: nil, queue: .main, using: hide),
      center.addObserver(forName: UIScene.didActivateNotification, object: nil, queue: .main, using: hide),
    ]
  }

  private func stopObserving() {
    observers.forEach { NotificationCenter.default.removeObserver($0) }
    observers = []
  }

  private func scene() -> UIWindowScene? {
    let scenes = UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }
    return scenes.first { $0.activationState == .foregroundActive }
      ?? scenes.first { $0.activationState == .foregroundInactive }
      ?? scenes.first
  }

  private func showCover() {
    guard enabled, coverWindow == nil, let scene = scene() else { return }

    let controller = UIViewController()
    controller.view.backgroundColor = background

    let symbol = UIImage.SymbolConfiguration(pointSize: 44, weight: .regular)
    let lock = UIImageView(image: UIImage(systemName: "lock.fill", withConfiguration: symbol))
    lock.tintColor = tint
    lock.translatesAutoresizingMaskIntoConstraints = false
    controller.view.addSubview(lock)
    NSLayoutConstraint.activate([
      lock.centerXAnchor.constraint(equalTo: controller.view.centerXAnchor),
      lock.centerYAnchor.constraint(equalTo: controller.view.centerYAnchor),
    ])

    let window = UIWindow(windowScene: scene)
    window.windowLevel = .alert + 1
    window.rootViewController = controller
    window.isHidden = false
    coverWindow = window
  }

  private func hideCover() {
    guard let window = coverWindow else { return }
    window.isHidden = true
    window.rootViewController = nil
    coverWindow = nil
  }
}
