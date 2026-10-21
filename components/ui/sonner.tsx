'use client'

import { Toaster as Sonner, type ToasterProps } from 'sonner'

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      theme="light"
      position="top-center"
      richColors
      duration={3500}
      closeButton={false}
      {...props}
    />
  )
}

export { Toaster }
