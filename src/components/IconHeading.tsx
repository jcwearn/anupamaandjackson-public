import React from 'react'
import { AnchorScrollMt } from '../lib/anchorOffset'
import CopyLinkButton from './CopyLinkButton'

// Centred icon above a heading, the way the same sections read on WithJoy.
// `anchorId` is opt-in, matching StickySectionHeading — pass it and the heading
// becomes the deep-link target itself and grows a copy-link button.
const IconHeading: React.FC<{
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>
  title: string
  anchorId?: string
}> = ({ icon: Icon, title, anchorId }) => {
  const scrollMt = React.useContext(AnchorScrollMt)

  return (
    <div id={anchorId} className={`group/copy text-center ${scrollMt}`}>
      <Icon className="mx-auto h-9 w-9 text-rosewood/80" />
      <div className="mt-2 flex items-center justify-center gap-2">
        <h2 className="font-display text-2xl text-rosewood">{title}</h2>
        {anchorId && <CopyLinkButton id={anchorId} label={title} />}
      </div>
    </div>
  )
}

export default IconHeading
