import React from 'react'
import { Link } from 'react-router-dom'
import './PrivacyPolicy.css'

const PrivacyPolicy: React.FC = () => {
  return (
    <div className="container">
      <main className="privacy-main">
        <h1 className="privacy-title">Privacy Policy</h1>
        <p className="privacy-updated">Effective date: {new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</p>

        <p className="privacy-intro">
          Thank you for using Rail Statistics (&quot;we,&quot; &quot;our,&quot; or &quot;us&quot;). Your privacy is important, and this Privacy Policy explains how your information is collected, used, and protected.
        </p>

        <section className="privacy-section">
          <h2>1. Information Collection</h2>
          <h3>Device Information and Crash Reports</h3>
          <p>
            Rail Statistics may collect device-specific data, including device identifiers, operating system versions, and crash reports. This information helps improve app stability and performance.
          </p>
          <h3>1.1 – Local Data Storage</h3>
          <p>
            The app allows you to import data (e.g., station visits and ticket data) from files on your device. All imported data remains solely on your device and is not transmitted or shared externally by the app. However, imported data can appear on your other devices via the widget functionality provided by Apple&apos;s ecosystem.
          </p>
        </section>

        <section className="privacy-section">
          <h2>2. Payments and In-App Purchases</h2>
          <p>
            Rail Statistics offers in-app purchases managed exclusively by Apple. When you make an in-app purchase, payment transactions are processed directly by Apple. Rail Statistics does not collect, store, or have access to any of your payment details or billing information. Please refer to <a href="https://www.apple.com/legal/privacy/" target="_blank" rel="noopener noreferrer">Apple&apos;s Privacy Policy</a> for details about how your payment information is processed and secured.
          </p>
        </section>

        <section className="privacy-section">
          <h2>3. Third-Party Services – Google AdMob</h2>
          <p>
            Rail Statistics uses Google AdMob to serve advertisements. When you first launch the app, you will be asked to consent to advertising data collection. This data is securely stored, managed, and processed by Google in compliance with GDPR regulations. For more details, please review <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer">Google&apos;s privacy policy</a>.
          </p>
        </section>

        <section className="privacy-section">
          <h2>4. Data Sharing</h2>
          <p>
            Rail Statistics does not share, sell, or transmit your data externally, except for the third-party advertising outlined above. All user-generated data imported into the app is stored exclusively on your device(s).
          </p>
        </section>

        <section className="privacy-section">
          <h2>5. Children&apos;s Privacy</h2>
          <p>
            Rail Statistics is not intended for use by individuals under the age of 16. We do not knowingly collect personal information from children under 16. If we become aware of data collected from individuals under 16 without parental consent, we will promptly delete it.
          </p>
        </section>

        <section className="privacy-section">
          <h2>6. Security</h2>
          <p>
            We are committed to protecting the security of your information. All data imported and stored in the Rail Statistics app remains on-device. However, no method of electronic storage is 100% secure, and while we strive to protect your data, we cannot guarantee its absolute security.
          </p>
        </section>

        <section className="privacy-section">
          <h2>7. Changes to this Privacy Policy</h2>
          <p>
            We may update this Privacy Policy periodically. Any changes will be reflected by revising the &quot;Effective Date&quot; above. We encourage you to periodically review this policy to stay informed about how we protect your information.
          </p>
        </section>

        <section className="privacy-section">
          <h2>8. Contact Us</h2>
          <p>
            For any questions or concerns regarding this Privacy Policy, don&apos;t hesitate to get in touch with us by email at: <a href="mailto:support@railstatistics.co.uk">support@railstatistics.co.uk</a>. By using Rail Statistics, you acknowledge and agree to this Privacy Policy.
          </p>
        </section>

        <p className="privacy-back">
          <Link to="/">← Back to home</Link>
        </p>
      </main>
    </div>
  )
}

export default PrivacyPolicy
