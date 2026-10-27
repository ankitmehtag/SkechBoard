export function WelcomeScreen() {
  return (
    <div className="welcome" aria-hidden="true">
      <div className="welcome-hint menu-hint">← Export, preferences, ...</div>
      <div className="welcome-hint tools-hint">Pick a tool &amp; start drawing!</div>
      <div className="welcome-center">
        <div className="logo">Sketchboard</div>
        <p>
          Your drawings are saved in your browser's storage.
          <br />
          Browser storage can be cleared unexpectedly.
          <br />
          Save your work to a file regularly to avoid losing it.
        </p>
      </div>
      <div className="welcome-hint help-hint">Shortcuts &amp; help →</div>
    </div>
  );
}
