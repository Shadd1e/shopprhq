'use client'

const S = {
  fill: 'none' as const,
  stroke: '#16a34a',
  strokeWidth: 1.6,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
}

// ── Individual doodle shapes, all centered at 0,0 ──────────────────────────

function Bag() {
  return (
    <g {...S}>
      <path d="M-20,0 L-22,48 L22,48 L20,0 Z" />
      <path d="M-10,0 C-10,-20 10,-20 10,0" />
      <line x1="-8" y1="24" x2="8" y2="24" />
    </g>
  )
}

function PriceTag() {
  return (
    <g {...S}>
      <path d="M-14,-24 L-14,6 L0,20 L14,6 L14,-24 Z" />
      <circle cx="0" cy="-16" r="4" fill="none" />
      <line x1="-7" y1="-4" x2="7" y2="-4" />
      <line x1="-7" y1="3" x2="5" y2="3" />
    </g>
  )
}

function Star() {
  return (
    <path {...S}
      d="M0,-22 L5,-8 L20,-8 L8,2 L13,18 L0,9 L-13,18 L-8,2 L-20,-8 L-5,-8 Z" />
  )
}

function Cart() {
  return (
    <g {...S}>
      <path d="M-20,8 L-18,-10 L18,-10 L16,8 Z" />
      <path d="M-24,-10 L-28,-18" />
      <circle cx="-11" cy="16" r="5" fill="none" />
      <circle cx="9" cy="16" r="5" fill="none" />
      <line x1="-6" y1="-10" x2="-6" y2="8" />
      <line x1="4" y1="-10" x2="4" y2="8" />
    </g>
  )
}

function Coin() {
  return (
    <g {...S}>
      <circle cx="0" cy="0" r="20" fill="none" />
      <line x1="-7" y1="-9" x2="-7" y2="9" />
      <line x1="7" y1="-9" x2="7" y2="9" />
      <path d="M-7,-9 L7,9" />
      <line x1="-10" y1="-2" x2="10" y2="-2" />
      <line x1="-10" y1="3" x2="10" y2="3" />
    </g>
  )
}

function Receipt() {
  return (
    <g {...S}>
      <path d="M-14,-26 L-14,22 Q-7,17 0,22 Q7,17 14,22 L14,-26 Z" />
      <line x1="-8" y1="-18" x2="8" y2="-18" />
      <line x1="-8" y1="-11" x2="6" y2="-11" />
      <line x1="-8" y1="-4" x2="8" y2="-4" />
      <line x1="-8" y1="3" x2="5" y2="3" />
      <line x1="-8" y1="10" x2="8" y2="10" />
    </g>
  )
}

function Box() {
  return (
    <g {...S}>
      <rect x="-18" y="-2" width="36" height="30" rx="2" />
      <path d="M-18,-2 L0,-14 L18,-2" />
      <line x1="-18" y1="12" x2="18" y2="12" />
    </g>
  )
}

function Sparkle() {
  return (
    <path {...S}
      d="M0,-18 L3,-3 L18,0 L3,3 L0,18 L-3,3 L-18,0 L-3,-3 Z" />
  )
}

function Card() {
  return (
    <g {...S}>
      <rect x="-26" y="-16" width="52" height="32" rx="4" />
      <rect x="-18" y="-7" width="12" height="9" rx="2" />
      <line x1="-18" y1="8" x2="18" y2="8" />
      <line x1="-18" y1="13" x2="4" y2="13" />
    </g>
  )
}

function Check() {
  return (
    <g {...S}>
      <circle cx="0" cy="0" r="18" fill="none" />
      <path d="M-9,0 L-2,8 L10,-8" />
    </g>
  )
}

function ArrowUp() {
  return (
    <g {...S}>
      <line x1="0" y1="20" x2="0" y2="-14" />
      <path d="M-8,-6 L0,-20 L8,-6" />
      <line x1="-6" y1="16" x2="6" y2="16" />
    </g>
  )
}

function Percent() {
  return (
    <g {...S}>
      <circle cx="0" cy="0" r="20" fill="none" />
      <path d="M-8,9 L8,-9" />
      <circle cx="-4" cy="-5" r="3.5" fill="none" />
      <circle cx="4" cy="5" r="3.5" fill="none" />
    </g>
  )
}

function Tag() {
  return (
    <g {...S}>
      <path d="M2,-20 L18,-4 L2,16 L-14,16 L-14,-20 Z" />
      <circle cx="-6" cy="-10" r="3.5" fill="none" />
    </g>
  )
}

function Gift() {
  return (
    <g {...S}>
      <rect x="-18" y="-2" width="36" height="24" rx="2" />
      <line x1="-18" y1="8" x2="18" y2="8" />
      <line x1="0" y1="-2" x2="0" y2="22" />
      <path d="M0,-2 C0,-2 -10,-14 -6,-18 C-2,-22 4,-16 0,-2" />
      <path d="M0,-2 C0,-2 10,-14 6,-18 C2,-22 -4,-16 0,-2" />
    </g>
  )
}

function Diamond() {
  return (
    <g {...S}>
      <path d="M0,-22 L18,-4 L0,18 L-18,-4 Z" />
      <path d="M-18,-4 L0,4 L18,-4" />
    </g>
  )
}

// ── Placed scene ───────────────────────────────────────────────────────────

export default function DoodleBackground() {
  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden" style={{ zIndex: 0 }}>
      <svg
        width="100%" height="100%"
        viewBox="0 0 1440 900"
        preserveAspectRatio="xMidYMid slice"
        className="opacity-[0.09]"
      >
        {/* ── Top band ── */}
        <g transform="translate(60,100) rotate(-12) scale(0.7)"><Tag /></g>
        <g transform="translate(120,130) rotate(-8) scale(1.1)"><Bag /></g>
        <g transform="translate(200,55) rotate(18) scale(0.6)"><Sparkle /></g>
        <g transform="translate(290,78) rotate(22) scale(0.7)"><Sparkle /></g>
        <g transform="translate(365,110) rotate(-5) scale(0.75)"><Diamond /></g>
        <g transform="translate(440,95) rotate(14)"><PriceTag /></g>
        <g transform="translate(540,60) rotate(-20) scale(0.6)"><Sparkle /></g>
        <g transform="translate(630,72) rotate(-5) scale(0.9)"><Star /></g>
        <g transform="translate(720,115) rotate(10) scale(0.65)"><Gift /></g>
        <g transform="translate(830,125) rotate(-10) scale(0.95)"><Cart /></g>
        <g transform="translate(930,62) rotate(28) scale(0.6)"><Tag /></g>
        <g transform="translate(1030,68) rotate(32) scale(0.65)"><Sparkle /></g>
        <g transform="translate(1120,120) rotate(-7) scale(0.8)"><Diamond /></g>
        <g transform="translate(1210,105) rotate(16) scale(0.9)"><Coin /></g>
        <g transform="translate(1310,55) rotate(40) scale(0.6)"><Sparkle /></g>
        <g transform="translate(1390,135) rotate(-12) scale(0.8)"><Receipt /></g>

        {/* ── Upper-mid band ── */}
        <g transform="translate(45,260) rotate(6) scale(0.72)"><Card /></g>
        <g transform="translate(200,290) rotate(-16) scale(0.65)"><ArrowUp /></g>
        <g transform="translate(345,248) rotate(30) scale(0.6)"><Sparkle /></g>
        <g transform="translate(500,275) rotate(-8) scale(0.8)"><Check /></g>
        <g transform="translate(660,255) rotate(12) scale(0.7)"><Percent /></g>
        <g transform="translate(800,285) rotate(-24) scale(0.65)"><Sparkle /></g>
        <g transform="translate(950,260) rotate(8) scale(0.78)"><Box /></g>
        <g transform="translate(1095,245) rotate(-14) scale(0.7)"><Star /></g>
        <g transform="translate(1240,282) rotate(22) scale(0.65)"><Coin /></g>
        <g transform="translate(1395,255) rotate(-6) scale(0.72)"><Card /></g>

        {/* ── Middle band ── */}
        <g transform="translate(88,455) rotate(8) scale(0.85)"><ArrowUp /></g>
        <g transform="translate(185,430) rotate(-30) scale(0.6)"><Tag /></g>
        <g transform="translate(275,425) rotate(-14) scale(0.85)"><Card /></g>
        <g transform="translate(385,465) rotate(36) scale(0.6)"><Sparkle /></g>
        <g transform="translate(490,475) rotate(11) scale(0.9)"><Box /></g>
        <g transform="translate(590,432) rotate(-8) scale(0.7)"><Gift /></g>
        <g transform="translate(690,405) rotate(42) scale(0.7)"><Sparkle /></g>
        <g transform="translate(785,460) rotate(-15) scale(0.75)"><Diamond /></g>
        <g transform="translate(880,465) rotate(-9) scale(1.05)"><Percent /></g>
        <g transform="translate(980,428) rotate(25) scale(0.65)"><Sparkle /></g>
        <g transform="translate(1070,415) rotate(18) scale(1.1)"><Bag /></g>
        <g transform="translate(1175,458) rotate(-10) scale(0.7)"><Check /></g>
        <g transform="translate(1270,455) rotate(13) scale(0.7)"><Sparkle /></g>
        <g transform="translate(1370,432) rotate(-18) scale(0.75)"><Tag /></g>
        <g transform="translate(1430,405) rotate(-22) scale(0.85)"><PriceTag /></g>

        {/* ── Lower-mid band ── */}
        <g transform="translate(50,615) rotate(-10) scale(0.7)"><Coin /></g>
        <g transform="translate(190,630) rotate(15) scale(0.65)"><Sparkle /></g>
        <g transform="translate(330,608) rotate(-5) scale(0.78)"><ArrowUp /></g>
        <g transform="translate(480,625) rotate(20) scale(0.7)"><Gift /></g>
        <g transform="translate(625,610) rotate(-28) scale(0.65)"><Diamond /></g>
        <g transform="translate(770,632) rotate(8) scale(0.72)"><Receipt /></g>
        <g transform="translate(915,612) rotate(-12) scale(0.68)"><Star /></g>
        <g transform="translate(1055,628) rotate(32) scale(0.6)"><Sparkle /></g>
        <g transform="translate(1195,608) rotate(-6) scale(0.75)"><Cart /></g>
        <g transform="translate(1355,625) rotate(14) scale(0.7)"><Box /></g>

        {/* ── Bottom band ── */}
        <g transform="translate(55,820) rotate(-14) scale(0.65)"><Sparkle /></g>
        <g transform="translate(155,740) rotate(9) scale(0.72)"><Sparkle /></g>
        <g transform="translate(255,808) rotate(18) scale(0.7)"><Tag /></g>
        <g transform="translate(360,760) rotate(-14) scale(0.9)"><Check /></g>
        <g transform="translate(465,835) rotate(-8) scale(0.65)"><Diamond /></g>
        <g transform="translate(570,705) rotate(10) scale(0.85)"><Star /></g>
        <g transform="translate(668,842) rotate(28) scale(0.6)"><Sparkle /></g>
        <g transform="translate(770,752) rotate(-6) scale(0.95)"><Cart /></g>
        <g transform="translate(868,830) rotate(-20) scale(0.68)"><Gift /></g>
        <g transform="translate(970,722) rotate(-19) scale(0.85)"><Coin /></g>
        <g transform="translate(1068,848) rotate(12) scale(0.65)"><Sparkle /></g>
        <g transform="translate(1160,770) rotate(7) scale(0.8)"><Receipt /></g>
        <g transform="translate(1270,828) rotate(-16) scale(0.7)"><PriceTag /></g>
        <g transform="translate(1380,718) rotate(-11) scale(0.9)"><Box /></g>

        {/* ── Extras scattered ── */}
        <g transform="translate(580,265) rotate(-18) scale(0.75)"><PriceTag /></g>
        <g transform="translate(1130,255) rotate(20) scale(0.7)"><Sparkle /></g>
        <g transform="translate(740,330) rotate(-6) scale(0.8)"><Card /></g>
        <g transform="translate(350,540) rotate(22) scale(0.65)"><Coin /></g>
        <g transform="translate(1050,540) rotate(-15) scale(0.7)"><ArrowUp /></g>
        <g transform="translate(700,580) rotate(8) scale(0.6)"><Sparkle /></g>
      </svg>
    </div>
  )
}
