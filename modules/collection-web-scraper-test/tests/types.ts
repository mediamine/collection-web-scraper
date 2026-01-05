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
