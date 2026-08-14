import React from 'react'
import clsx from 'clsx'

interface Props extends React.HTMLAttributes<HTMLDivElement> {
  width?: 'sm' | 'md' | 'lg' | 'xl'
}

const widths: Record<NonNullable<Props['width']>, string> = {
  sm: 'max-w-screen-sm',
  md: 'max-w-screen-md',
  lg: 'max-w-screen-lg',
  xl: 'max-w-screen-xl',
}

const Container: React.FC<Props> = ({ width = 'lg', className, ...rest }) => (
  <div className={clsx('mx-auto w-full px-4', widths[width], className)} {...rest} />
)

export default Container
