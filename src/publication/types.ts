export interface AuthenticateFnProps {
  page: Record<string, any>;
}

export interface ScanFnProps {
  page: Record<string, any>;
  url: string;
}

export interface ArticleLinkProps {
  link: string;
  title: string;
  description: string;
}

export interface ArticleProps {
  text: string;
}

export interface ScannerProps {
  authenticate(authenticateFnProps: AuthenticateFnProps): Promise<void>;
  scanHome(scanFnProps: ScanFnProps): Promise<Array<ArticleLinkProps>>;
  scanArticle(scanFnProps: ScanFnProps): Promise<ArticleProps>;
  logout(authenticateFnProps: AuthenticateFnProps): Promise<void>;
}
