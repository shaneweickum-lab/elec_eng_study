/** Full-screen layout for the simulator: no navigation chrome. */
export default function LabLayout({ children }: { children: React.ReactNode }) {
  return <div className="h-dvh overflow-hidden">{children}</div>;
}
