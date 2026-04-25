import { ImageResponse } from 'next/og'

export const size = { width: 512, height: 512 }
export const contentType = 'image/png'

export default function Icon() {
  return new ImageResponse(
    (
      <div style={{
        width: 512, height: 512,
        background: '#171717',
        borderRadius: 96,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <div style={{
          width: 280, height: 280,
          borderRadius: '50%',
          border: '20px solid #f59e0b',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <div style={{
            width: 60, height: 60,
            background: '#f59e0b',
            borderRadius: '50%',
          }} />
        </div>
      </div>
    ),
    { ...size }
  )
}
