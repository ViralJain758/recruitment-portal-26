import MLSCLogo from "../assets/MLSC-logo.png";

export default function AuthPanel({
  compact = false,
  className = "",
  copy,
  id,
  pageClass = "",
  title,
  children,
}) {
  return (
    <main
      className={`auth-page${compact ? " auth-page--compact" : ""} ${pageClass}`.trim()}
    >
      <section className={`auth-panel ${className}`.trim()} aria-labelledby={id}>
        <div className="panel-header">
          <img className="panel-logo" src={MLSCLogo} alt="MLSC logo" />
          <h2 id={id}>{title}</h2>
          <p className="panel-copy">{copy}</p>
        </div>
        {children}
      </section>
    </main>
  );
}
