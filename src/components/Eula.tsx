import React from 'react'
import { Link } from 'react-router-dom'
import './Eula.css'

const Eula: React.FC = () => {
  return (
    <div className="container">
      <main className="eula-main">
        <h1 className="eula-title">END USER LICENCE AGREEMENT</h1>
        <p className="eula-updated">Last updated February 26, 2026</p>

        <p className="eula-intro">
          Rail Statistics is licensed to You (End-User) by Rail Statistics, located and registered at 1 Runtlings Lane, Wakefield, West Yorkshire WF5 8JL, England (&apos;Licensor&apos;), for use only under the terms of this Licence Agreement.
        </p>
        <p className="eula-intro">
          By downloading the Licensed Application from Apple&apos;s software distribution platform (&apos;App Store&apos;) and Google&apos;s software distribution platform (&apos;Play Store&apos;), and any update thereto (as permitted by this Licence Agreement), You indicate that You agree to be bound by all of the terms and conditions of this Licence Agreement, and that You accept this Licence Agreement.
        </p>
        <p className="eula-intro">
          Rail Statistics, not the Services, is solely responsible for the Licensed Application and the content thereof. This Licence Agreement may not provide for usage rules for the Licensed Application that are in conflict with the latest Apple Media Services Terms and Conditions and Google Play Terms of Service (&apos;Usage Rules&apos;). Rail Statistics acknowledges that it had the opportunity to review the Usage Rules and this Licence Agreement is not conflicting with them.
        </p>
        <p className="eula-intro">
          Rail Statistics when purchased or downloaded through the Services, is licensed to You for use only under the terms of this Licence Agreement. The Licensor reserves all rights not expressly granted to You. Rail Statistics is to be used on devices that operate with Apple&apos;s operating systems (&apos;iOS&apos; and &apos;Mac OS&apos;) or Google&apos;s operating system (&apos;Android&apos;).
        </p>

        <section className="eula-section">
          <h2>TABLE OF CONTENTS</h2>
          <ol className="eula-toc">
            <li>THE APPLICATION</li>
            <li>SCOPE OF LICENCE</li>
            <li>TECHNICAL REQUIREMENTS</li>
            <li>MAINTENANCE AND SUPPORT</li>
            <li>USE OF DATA</li>
            <li>USER-GENERATED CONTRIBUTIONS</li>
            <li>CONTRIBUTION LICENCE</li>
            <li>LIABILITY</li>
            <li>WARRANTY</li>
            <li>PRODUCT CLAIMS</li>
            <li>LEGAL COMPLIANCE</li>
            <li>CONTACT INFORMATION</li>
            <li>TERMINATION</li>
            <li>THIRD-PARTY TERMS OF AGREEMENTS AND BENEFICIARY</li>
            <li>INTELLECTUAL PROPERTY RIGHTS</li>
            <li>APPLICABLE LAW</li>
            <li>MISCELLANEOUS</li>
          </ol>
        </section>

        <section className="eula-section">
          <h2>1. THE APPLICATION</h2>
          <p>
            Rail Statistics (&apos;Licensed Application&apos;) is a piece of software created to allow users to keep track of railway stations visited on the go, as well to keep track of rail fares. and customised for iOS and Android mobile devices (&apos;Devices&apos;). It is used to track railway stations visited on the go...
          </p>
          <p>
            The Licensed Application is not tailored to comply with industry-specific regulations (Health Insurance Portability and Accountability Act (HIPAA), Federal Information Security Management Act (FISMA), etc.), so if your interactions would be subjected to such laws, you may not use this Licensed Application. You may not use the Licensed Application in a way that would violate the Gramm-Leach-Bliley Act (GLBA).
          </p>
        </section>

        <section className="eula-section">
          <h2>2. SCOPE OF LICENCE</h2>
          <ul>
            <li><strong>2.1</strong> You are given a non-transferable, non-exclusive, non-sublicensable licence to install and use the Licensed Application on any Devices that You (End-User) own or control and as permitted by the Usage Rules, with the exception that such Licensed Application may be accessed and used by other accounts associated with You (End-User, The Purchaser) via Family Sharing or volume purchasing.</li>
            <li><strong>2.2</strong> This licence will also govern any updates of the Licensed Application provided by Licensor that replace, repair, and/or supplement the first Licensed Application, unless a separate licence is provided for such update, in which case the terms of that new licence will govern.</li>
            <li><strong>2.3</strong> You may not share or make the Licensed Application available to third parties (unless to the degree allowed by the Usage Rules, and with Rail Statistics&apos;s prior written consent), sell, rent, lend, lease or otherwise redistribute the Licensed Application.</li>
            <li><strong>2.4</strong> You may not reverse engineer, translate, disassemble, integrate, decompile, remove, modify, combine, create derivative works or updates of, adapt, or attempt to derive the source code of the Licensed Application, or any part thereof (except with Rail Statistics&apos;s prior written consent).</li>
            <li><strong>2.5</strong> You may not copy (excluding when expressly authorised by this licence and the Usage Rules) or alter the Licensed Application or portions thereof. You may create and store copies only on devices that You own or control for backup keeping under the terms of this licence, the Usage Rules, and any other terms and conditions that apply to the device or software used. You may not remove any intellectual property notices. You acknowledge that no unauthorised third parties may gain access to these copies at any time. If you sell your Devices to a third party, you must remove the Licensed Application from the Devices before doing so.</li>
            <li><strong>2.6</strong> Violations of the obligations mentioned above, as well as the attempt of such infringement, may be subject to prosecution and damages.</li>
            <li><strong>2.7</strong> Licensor reserves the right to modify the terms and conditions of licensing.</li>
            <li><strong>2.8</strong> Nothing in this licence should be interpreted to restrict third-party terms. When using the Licensed Application, You must ensure that You comply with applicable third-party terms and conditions.</li>
          </ul>
        </section>

        <section className="eula-section">
          <h2>3. TECHNICAL REQUIREMENTS</h2>
          <ul>
            <li><strong>3.1</strong> The Licensed Application requires a firmware version 26.03.1 or higher. Licensor recommends using the latest version of the firmware.</li>
            <li><strong>3.2</strong> Licensor attempts to keep the Licensed Application updated so that it complies with modified/new versions of the firmware and new hardware. You are not granted rights to claim such an update.</li>
            <li><strong>3.3</strong> You acknowledge that it is Your responsibility to confirm and determine that the app end-user device on which You intend to use the Licensed Application satisfies the technical specifications mentioned above.</li>
            <li><strong>3.4</strong> Licensor reserves the right to modify the technical specifications as it sees appropriate at any time.</li>
          </ul>
        </section>

        <section className="eula-section">
          <h2>4. MAINTENANCE AND SUPPORT</h2>
          <ul>
            <li><strong>4.1</strong> The Licensor is solely responsible for providing any maintenance and support services for this Licensed Application. You can reach the Licensor at the email address listed in the App Store or Play Store Overview for this Licensed Application.</li>
            <li><strong>4.2</strong> Rail Statistics and the End-User acknowledge that the Services have no obligation whatsoever to furnish any maintenance and support services with respect to the Licensed Application.</li>
          </ul>
        </section>

        <section className="eula-section">
          <h2>5. USE OF DATA</h2>
          <p>
            You acknowledge that Licensor will be able to access and adjust Your downloaded Licensed Application content and Your personal information, and that Licensor&apos;s use of such material and information is subject to Your legal agreements with Licensor and Licensor&apos;s privacy policy, which can be accessed via Settings &gt; About App &gt; Privacy Policy, or by visiting <a href="https://www.railstatistics.co.uk/privacy" target="_blank" rel="noopener noreferrer">http://www.railstatistics.co.uk/privacy</a>.
          </p>
          <p>
            You acknowledge that the Licensor may periodically collect and use technical data and related information about your device, system, and application software, and peripherals, offer product support, facilitate the software updates, and for purposes of providing other services to you (if any) related to the Licensed Application. Licensor may also use this information to improve its products or to provide services or technologies to you, as long as it is in a form that does not personally identify you.
          </p>
        </section>

        <section className="eula-section">
          <h2>6. USER-GENERATED CONTRIBUTIONS</h2>
          <p>
            The Licensed Application may invite you to chat, contribute to, or participate in blogs, message boards, online forums, and other functionality, and may provide you with the opportunity to create, submit, post, display, transmit, perform, publish, distribute, or broadcast content and materials to us or in the Licensed Application, including but not limited to text, writings, video, audio, photographs, graphics, comments, suggestions, or personal information or other material (collectively, &apos;Contributions&apos;). Contributions may be viewable by other users of the Licensed Application and through third-party websites or applications. As such, any Contributions you transmit may be treated as non-confidential and non-proprietary.
          </p>
          <p>When you create or make available any Contributions, you represent and warrant that:</p>
          <ol>
            <li>Your Contributions do not infringe proprietary rights of any third party.</li>
            <li>You are the creator and owner of or have the necessary licences and rights to use and authorise the use of your Contributions.</li>
            <li>You have written consent from every identifiable individual in your Contributions.</li>
            <li>Your Contributions are not false, inaccurate, or misleading.</li>
            <li>Your Contributions are not unsolicited advertising or spam.</li>
            <li>Your Contributions are not obscene, violent, harassing, or otherwise objectionable.</li>
            <li>Your Contributions do not ridicule, mock, or abuse anyone.</li>
            <li>Your Contributions are not used to harass or promote violence.</li>
            <li>Your Contributions do not violate any applicable law.</li>
            <li>Your Contributions do not violate privacy or publicity rights.</li>
            <li>Your Contributions do not violate laws concerning child pornography or the well-being of minors.</li>
            <li>Your Contributions do not include offensive comments connected to race, gender, etc.</li>
            <li>Your Contributions do not otherwise violate any provision of this Licence Agreement.</li>
          </ol>
          <p>Any use of the Licensed Application in violation of the foregoing violates this Licence Agreement and may result in termination or suspension of your rights.</p>
        </section>

        <section className="eula-section">
          <h2>7. CONTRIBUTION LICENCE</h2>
          <p>
            By posting your Contributions, you automatically grant us an unrestricted, unlimited, irrevocable, perpetual, non-exclusive, transferable, royalty-free, worldwide right and licence to host, use, copy, reproduce, disclose, sell, publish, and distribute such Contributions for any purpose. This includes the use of your name and any trademarks or images you provide. You waive all moral rights in your Contributions.
          </p>
          <p>
            We do not assert ownership over your Contributions; you retain full ownership. We are not liable for any statements in your Contributions. We have the right to edit, recategorise, or delete any Contributions at any time without notice. We have no obligation to monitor your Contributions.
          </p>
        </section>

        <section className="eula-section">
          <h2>8. LIABILITY</h2>
          <ul>
            <li><strong>8.1</strong> Licensor&apos;s responsibility in the case of violation of obligations and tort shall be limited to intent and gross negligence. In case of a breach of essential contractual duties, Licensor shall also be liable for slight negligence. Liability is limited to foreseeable, contractually typical damages, except for injuries to life, limb, or health.</li>
            <li><strong>8.2</strong> Licensor takes no accountability for damages caused by a breach of duties in Section 2. You are required to use backup functions to avoid data loss.</li>
            <li><strong>8.3</strong> Licensor takes no responsibility if unsafe use or misuse of the application on railway/metro/tram networks causes injuries or breaches of the network/service/operators terms of service or condtion of carriage; the liability falls on the user.</li>
          </ul>
        </section>

        <section className="eula-section">
          <h2>9. WARRANTY</h2>
          <ul>
            <li><strong>9.1</strong> Licensor warrants the application is free of malware at the time of download and works as described in documentation.</li>
            <li><strong>9.2</strong> No warranty is provided for applications that are non-executable due to unauthorised modification, inappropriate handling, or use with inappropriate hardware/software.</li>
            <li><strong>9.3</strong> You must inspect the application immediately and notify Rail Statistics of issues within fourteen (14) days of discovery.</li>
            <li><strong>9.4</strong> If defective, Rail Statistics may remedy the situation or provide a substitute.</li>
            <li><strong>9.5</strong> In case of warranty failure, you may notify the Store Operator for a refund of the purchase price. The Store Operator has no other warranty obligations.</li>
            <li><strong>9.6</strong> For entrepreneurs, claims expire after twelve (12) months; for consumers, statutory periods apply.</li>
          </ul>
        </section>

        <section className="eula-section">
          <h2>10. PRODUCT CLAIMS</h2>
          <p>
            Rail Statistics, not the Services, is responsible for addressing claims relating to the Licensed Application, including product liability, legal/regulatory non-conformance, and consumer protection or privacy claims.
          </p>
        </section>

        <section className="eula-section">
          <h2>11. LEGAL COMPLIANCE</h2>
          <p>
            You represent and warrant that you are not located in a country subject to a US Government embargo or designated as a &apos;terrorist supporting country,&apos; and are not on any prohibited parties list.
          </p>
        </section>

        <section className="eula-section">
          <h2>12. CONTACT INFORMATION</h2>
          <p>
            For inquiries or complaints, contact:
          </p>
          <p className="eula-address">
            Jack Wingate<br />
            1 Runtlings Lane<br />
            Wakefield, West Yorkshire WF5 8JL<br />
            England
          </p>
          <p>
            <a href="mailto:enquires@railstatistics.co.uk">enquires@railstatistics.co.uk</a>
          </p>
        </section>

        <section className="eula-section">
          <h2>13. TERMINATION</h2>
          <p>
            The licence is valid until terminated by Rail Statistics or You. Rights terminate automatically without notice if you fail to adhere to any terms. Upon termination, you must stop all use and destroy all copies of the application.
          </p>
        </section>

        <section className="eula-section">
          <h2>14. THIRD-PARTY TERMS OF AGREEMENTS AND BENEFICIARY</h2>
          <p>
            Rail Statistics will comply with applicable third-party terms. Apple and Google and their subsidiaries are third-party beneficiaries of this EULA and have the right to enforce it against You.
          </p>
        </section>

        <section className="eula-section">
          <h2>15. INTELLECTUAL PROPERTY RIGHTS</h2>
          <p>
            In the event of a third-party IP infringement claim, Rail Statistics (not the Services) is solely responsible for the investigation, defence, and settlement.
          </p>
        </section>

        <section className="eula-section">
          <h2>16. APPLICABLE LAW</h2>
          <p>
            This agreement is governed by the laws of England and Wales.
          </p>
        </section>

        <section className="eula-section">
          <h2>17. MISCELLANEOUS</h2>
          <ul>
            <li><strong>17.1</strong> If any term becomes invalid, the remaining provisions remain valid. Invalid terms will be replaced by valid ones achieving the primary purpose.</li>
            <li><strong>17.2</strong> Amendments are only valid if laid down in writing.</li>
          </ul>
        </section>

        <p className="eula-back">
          <Link to="/">← Back to home</Link>
        </p>
      </main>
    </div>
  )
}

export default Eula
