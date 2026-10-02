import { useState } from "react";
import Profiles, { Profile } from "./Profiles";

/** Profile chooser gate — picking a profile goes straight into the site. */
export default function Splash({ onDone }: { onDone: (p: Profile) => void }) {
  const [leaving, setLeaving] = useState(false);
  const pick = (p: Profile) => {
    setLeaving(true);
    setTimeout(() => onDone(p), 300);
  };
  return (
    <div className={`fixed inset-0 z-[200] bg-[#050505] transition-opacity duration-500 ${leaving ? "opacity-0 pointer-events-none" : "opacity-100"}`}>
      <Profiles onSelect={pick} />
    </div>
  );
}
