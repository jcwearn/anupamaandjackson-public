import React from 'react'

/**
 * What the portal does after Submit, as three steps. It is shown twice — in
 * the card under the portal button and in the modal that button opens — so it
 * lives here once and the two copies cannot drift apart.
 *
 * The portal confirms with a bare browser alert after a pause with no spinner
 * worth the name, which is when people press Submit a second time.
 */
const SubmitSteps: React.FC = () => (
  <ol className="list-decimal space-y-2 pl-5 marker:font-semibold marker:text-rosewood">
    <li>
      <strong>Wait a few seconds.</strong> It will look like nothing is happening — don’t press
      Submit again.
    </li>
    <li>
      <strong>Note your card numbers.</strong> A pop-up says “Arrival Card generated successfully”
      followed by a card number for each traveler. Jot them down or take a screenshot.
    </li>
    <li>
      <strong>Press OK.</strong> Your browser downloads the card(s). Save or print them and keep
      them with your passport and e-Visa approval.
    </li>
  </ol>
)

export default SubmitSteps
