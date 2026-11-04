import PasswordSection from '../components/settings/PasswordSection.jsx'
import ProfileSection from '../components/settings/ProfileSection.jsx'

// Wireframes v2, screen 5.
export default function SettingsPage() {
  return (
    <main className="page">
      <h1 className="page-title">Settings</h1>
      <ProfileSection />
      <PasswordSection />
    </main>
  )
}
