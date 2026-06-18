import React from 'react';
import {
  Menu,
  HardHat,
  LayoutDashboard,
  Lock,
  Unlock,
  Users,
  BarChart3,
  X,
  Clock,
  Fingerprint,
  KeyRound,
  Camera,
  IdCard,
  UserPlus,
  Edit,
  Trash2,
  Calendar,
  ArrowRight,
  ArrowLeft,
  Smartphone,
  Banknote,
  Scale,
  ShieldAlert,
  Printer,
  FileDown,
  PlaneTakeoff,
  Archive,
  FileText,
  CheckCircle,
  Home,
  Kanban,
  Bell,
  Settings,
  UserCheck,
  Activity,
  LayoutTemplate,
  RefreshCw,
  HelpCircle
} from 'lucide-react';

interface IconProps {
  name: string;
  size?: number;
  className?: string;
  strokeWidth?: number;
}

export const Icon: React.FC<IconProps> = ({ name, size = 24, className = "", strokeWidth = 2 }) => {
  const iconMap: Record<string, React.ComponentType<any>> = {
    'menu': Menu,
    'hard-hat': HardHat,
    'layout-dashboard': LayoutDashboard,
    'lock': Lock,
    'unlock': Unlock,
    'users': Users,
    'bar-chart-3': BarChart3,
    'x': X,
    'clock': Clock,
    'fingerprint': Fingerprint,
    'key-round': KeyRound,
    'camera': Camera,
    'id-card': IdCard,
    'user-plus': UserPlus,
    'edit-3': Edit,
    'trash-2': Trash2,
    'calendar': Calendar,
    'arrow-right': ArrowRight,
    'arrow-left': ArrowLeft,
    'smartphone': Smartphone,
    'banknote': Banknote,
    'scale': Scale,
    'shield-alert': ShieldAlert,
    'printer': Printer,
    'file-down': FileDown,
    'plane-takeoff': PlaneTakeoff,
    'archive': Archive,
    'file-text': FileText,
    'check-circle': CheckCircle,
    'home': Home,
    'kanban': Kanban,
    'bell': Bell,
    'settings': Settings,
    'user-check': UserCheck,
    'activity': Activity,
    'layout-template': LayoutTemplate,
    'refresh-cw': RefreshCw
  };

  const LucideIcon = iconMap[name] || HelpCircle;
  return <LucideIcon size={size} className={className} strokeWidth={strokeWidth} />;
};
