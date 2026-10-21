import {
  ArrowRight,
  Check,
  Copy,
  Eye,
  Moon,
  Plus,
  Receipt,
  Share,
  Sun,
  Trash2,
  Upload,
  Users,
  X,
} from "lucide-react";

const icons = {
  plus: Plus,
  arrow: ArrowRight,
  share: Share,
  receipt: Receipt,
  users: Users,
  check: Check,
  copy: Copy,
  x: X,
  eye: Eye,
  upload: Upload,
  moon: Moon,
  sun: Sun,
  trash: Trash2,
};

type IconName = keyof typeof icons;

export function Icon({
  name,
  className = "size-5",
}: {
  name: IconName;
  className?: string;
}) {
  const LucideIcon = icons[name];
  return (
    <LucideIcon aria-hidden="true" className={className} strokeWidth={1.8} />
  );
}
