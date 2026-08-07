const DEFAULT_LOGO_SRC = '/boozepap-logo.svg';

type BrandLogoProps = { footer?: boolean; src?: string };

export function BrandLogo({ footer = false, src }: BrandLogoProps) {
  const resolvedSrc = src || DEFAULT_LOGO_SRC;

  return (
    <div className="flex shrink-0 items-center text-left">
      <img
        src={resolvedSrc}
        alt="BoozePap"
        className={footer ? 'h-28 w-auto object-contain' : 'h-16 w-auto object-contain sm:h-20'}
      />
    </div>
  );
}
