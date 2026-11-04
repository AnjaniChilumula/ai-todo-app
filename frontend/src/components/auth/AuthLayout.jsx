import Brand from '../Brand.jsx'

// The centred card used by the sign-in and sign-up pages (wireframes v2, screens 1 and 2).
export default function AuthLayout({ title, subtitle, footer, children }) {
  return (
    <main className="auth-page">
      <Brand />
      <section className="card auth-card" aria-labelledby="auth-title">
        <div className="auth-heading">
          <h1 id="auth-title">{title}</h1>
          <p>{subtitle}</p>
        </div>
        {children}
        <p className="auth-footer">{footer}</p>
      </section>
    </main>
  )
}
