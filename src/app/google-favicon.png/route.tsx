import { ImageResponse } from 'next/og';

export const dynamic = 'force-static';

export function GET() {
  return new ImageResponse(
    <div
      style={{
        alignItems: 'center',
        background: '#fffaf5',
        border: '5px solid #f1e5dc',
        borderRadius: '22px',
        display: 'flex',
        height: '100%',
        justifyContent: 'center',
        letterSpacing: '-9px',
        width: '100%',
      }}
    >
      <span style={{ color: '#111111', fontFamily: 'serif', fontSize: 70, fontWeight: 900 }}>B</span>
      <span style={{ color: '#c8102e', fontFamily: 'serif', fontSize: 70, fontWeight: 900 }}>P</span>
      <span style={{ color: '#d88700', fontSize: 20, marginLeft: 5, marginTop: -46 }}>●</span>
    </div>,
    { width: 96, height: 96 },
  );
}
