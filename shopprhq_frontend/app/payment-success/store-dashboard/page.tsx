// This route previously held a byte-identical 915-line copy of
// app/store-dashboard/page.tsx. Any dashboard fix made to one silently
// never reached the other. Re-exporting the canonical component instead —
// edit app/store-dashboard/page.tsx and both routes update together.
export { default } from '@/app/store-dashboard/page'
