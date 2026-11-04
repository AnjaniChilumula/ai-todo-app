import { useState } from 'react'

import PasswordSection from '../components/settings/PasswordSection.jsx'
import ProfileSection from '../components/settings/ProfileSection.jsx'
import SessionsSection from '../components/settings/SessionsSection.jsx'

// Wireframes v2, screen 5.
export default function SettingsPage() {
  // Changing the password signs other devices out, so reload the device list afterwards.
  const [devicesVersion, setDevicesVersion] = useState(0)

  return (
    <main className="page">
      <h1 className="page-title">Settings</h1>
      <ProfileSection />
      <PasswordSection onChanged={() => setDevicesVersion((v) => v + 1)} />
      <SessionsSection key={devicesVersion} />
    </main>
  )
}
