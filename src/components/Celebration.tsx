import React from 'react'
import clsx from 'clsx'

interface Props {
  className?: string
}

const Celebration: React.FC<Props> = ({ className }) => {
  return (
    <div className={clsx('text-center text-rosewood max-w-2xl mx-auto', className)}>
      <p className="text-lg leading-relaxed">
        She said yes! Thank you to everyone who could be there to celebrate with us! Photos and more
        coming soon!
      </p>
    </div>
  )
}

export default Celebration
