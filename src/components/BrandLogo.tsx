const DEFAULT_LOGO_SRC = '/boozepap-logo.svg';

type BrandLogoProps = { footer?: boolean; src?: string };

export function BrandLogo({ footer = false, src }: BrandLogoProps) {
  const resolvedSrc = src || DEFAULT_LOGO_SRC;

  return (
    <div className="flex shrink-0 items-center text-left">
      <img
        src={resolvedSrc}
        alt="BoozePap"
        className={footer ? 'h-24 w-auto max-w-full object-contain' : 'h-14 w-auto max-w-[190px] object-contain sm:h-16 sm:max-w-[230px]'}
      />
    </div>
  );
}
