import { InfoIcon } from './icons.jsx'

const SETUP_URL = 'https://github.com/AnjaniChilumula/ai-todo-app#run-the-backend'

export default function AiOffBanner({ demo }) {
  return (
    <section className="card banner" aria-label="AI features are off">
      <div className="banner-text">
        <InfoIcon size={20} />
        {demo ? (
          <p>
            You’re using the online demo. Tasks are saved in this browser only, and the AI features
            (Smart Add and Break it down) are off. Run the app on your computer to use them.
          </p>
        ) : (
          <p>
            Smart Add and Break it down are off. To turn them on, add <code>ANTHROPIC_API_KEY</code>{' '}
            to <code>backend/.env</code> and restart the server.
          </p>
        )}
      </div>
      <a className="banner-link" href={SETUP_URL} target="_blank" rel="noreferrer">
        {demo ? 'How to run it' : 'How to set it up'}
      </a>
    </section>
  )
}
