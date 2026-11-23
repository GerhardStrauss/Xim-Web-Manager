export interface XimProfile {
  id: string;
  game: string;
  console: 'PS4' | 'Xbox One' | 'PS3' | 'Xbox 360' | 'PC';
  color?: string;
  hotkey?: string;
  hip: SensitivitySettings;
  ads: AdsSettings;
  secondaryActivationKey?: string;
  bindings: {
    primary: Binding[];
    secondary: Binding[];
  };
  createdAt: number;
  updatedAt?: number;
  userId?: string;
  isFavorite?: boolean;
}

export interface Binding {
  id: string;
  actionName: string;
  consoleButton: string;
  pcKey: string;
}

export interface SensitivitySettings {
  sensitivity: number;
  synchronize: 'Off' | 'Default' | 'Common' | 'Slow';
  smoothing: number;
  yxRatio: number;
  steadyAim: number;
  boost: number;
  invertVertical?: boolean;
  leftStick?: boolean;
  curve: number[]; // Ballistic curve (points 0-100)
}

export interface AdsSettings extends SensitivitySettings {
  activationKey?: string;
  activationDelay?: number;
  inheritButtons?: boolean;
}
