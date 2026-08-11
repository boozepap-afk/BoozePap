import Link from 'next/link';

const DEFAULT_LOGO_SRC = '/boozepap-logo.svg';

type BrandLogoProps = { footer?: boolean; src?: string; href?: string };

export function BrandLogo({ footer = false, src, href = '/' }: BrandLogoProps) {
  const resolvedSrc = src || DEFAULT_LOGO_SRC;

  return (
    <Link href={href} aria-label="BoozePap home" className="flex shrink-0 items-center text-left">
      <img
        src={resolvedSrc}
        alt="BoozePap"
        className={footer ? 'h-28 w-auto max-w-full object-contain sm:h-32' : 'h-20 w-auto max-w-[250px] object-contain sm:h-24 sm:max-w-[320px]'}
      />
    </Link>
  );
}
