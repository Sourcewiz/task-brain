import './globals.css'

export const metadata = {
  title: 'Task Brain — Mary\'s Command Center',
  description: 'ADHD-friendly task management for the WizCommerce founding team',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}