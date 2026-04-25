import { ImageResponse } from 'next/og'

export const size = { width: 180, height: 180 }
export const contentType = 'image/png'

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div style={{
        width: 180, height: 180,
        background: '#171717',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <div style={{
          width: 100, height: 100,
          borderRadius: '50%',
          border: '8px solid #f59e0b',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <div style={{
            width: 24, height: 24,
            background: '#f59e0b',
            borderRadius: '50%',
          }} />
        </div>
      </div>
    ),
    { ...size }
  )
}
