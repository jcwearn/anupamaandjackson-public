import React from 'react'
import { ChevronDownIcon } from '../icons/ChevronDownIcon'
import { AnchorScrollMt } from '../lib/anchorOffset'
import CopyLinkButton from './CopyLinkButton'

export const Disclosure: React.FC<{ id: string; title: string; children: React.ReactNode }> = ({
  id,
  title,
  children,
}) => {
  const scrollMt = React.useContext(AnchorScrollMt)

  return (
    <details id={id} className={`group/disclosure card ${scrollMt}`}>
      <summary className="group/copy flex cursor-pointer list-none items-center justify-between gap-4 font-display text-xl text-rosewood [&::-webkit-details-marker]:hidden">
        {title}
        <span className="flex shrink-0 items-center gap-2">
          <CopyLinkButton id={id} label={title} />
          <ChevronDownIcon className="h-5 w-5 shrink-0 text-rosewood/70 transition-transform duration-200 group-open/disclosure:rotate-180" />
        </span>
      </summary>
      <div className="mt-3 space-y-3 text-sm leading-relaxed text-zeus/80">{children}</div>
    </details>
  )
}

export const DisclosureGroup: React.FC<{
  id: string
  title: string
  blurb: string
  children: React.ReactNode
}> = ({ id, title, blurb, children }) => {
  const scrollMt = React.useContext(AnchorScrollMt)

  return (
    <details id={id} className={`group/group ${scrollMt}`}>
      <summary className="group/copy flex cursor-pointer list-none items-start justify-between gap-4 border-b border-gold/40 pb-3 [&::-webkit-details-marker]:hidden">
        <span>
          <span className="block font-display text-2xl text-rosewood">{title}</span>
          <span className="mt-1 block text-sm text-zeus/70">{blurb}</span>
        </span>
        <span className="mt-1 flex shrink-0 items-center gap-2">
          <CopyLinkButton id={id} label={title} />
          <ChevronDownIcon className="h-6 w-6 shrink-0 text-rosewood/70 transition-transform duration-200 group-open/group:rotate-180" />
        </span>
      </summary>
      <div className="mt-4 flex flex-col gap-3">{children}</div>
    </details>
  )
}

export const Bullets: React.FC<{ items: React.ReactNode[] }> = ({ items }) => (
  <ul className="list-disc space-y-1.5 pl-4">
    {items.map((item, i) => (
      <li key={i}>{item}</li>
    ))}
  </ul>
)
