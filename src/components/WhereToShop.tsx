import React from 'react'
import { Bullets } from './Disclosure'

/**
 * Where to buy Indian clothing.
 *
 * Shared by the FAQ's "Where can I shop?" and the What to Wear page's own
 * section — both answer the same question, and a guest who reads one and then
 * the other should not find two different lists. Same reasoning as
 * GuestDressCodes, which the FAQ and Travel Tips share.
 */
const WhereToShop: React.FC = () => (
  <Bullets
    items={[
      <>
        If you’re in the Atlanta area,{' '}
        <a
          href="https://amsglobalmall.com/"
          target="_blank"
          rel="noreferrer"
          className="underline hover:text-rosewood"
        >
          Global Mall
        </a>{' '}
        is a great place to browse in person and get a feel for styles, fabrics, and sizing.
      </>,
      <>
        For online shopping,{' '}
        <a
          href="https://www.kalkifashion.com/"
          target="_blank"
          rel="noreferrer"
          className="underline hover:text-rosewood"
        >
          Kalki Fashion
        </a>{' '}
        is a popular and reliable retailer with a wide selection.
      </>,
      'And for the truly adventurous, you can always wait and shop in India itself, where the variety and prices are hard to beat. Just leave yourself enough time before the events!',
    ]}
  />
)

export default WhereToShop
