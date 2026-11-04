import { GOOGLE_SIGN_IN_URL } from '../../api/client.js'

// A real link, not fetch: the browser goes to the backend, which redirects to Google and back.
export default function GoogleButton({ label }) {
  return (
    <>
      <a className="button google-button" href={GOOGLE_SIGN_IN_URL}>
        <span className="google-mark" aria-hidden="true">
          G
        </span>
        {label}
      </a>
      <div className="or-divider" role="separator">
        <span>or</span>
      </div>
    </>
  )
}
