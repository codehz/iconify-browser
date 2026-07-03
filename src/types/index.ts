export interface CollectionItem {
  prefix: string;
  name: string;
  total: number;
  authorName: string;
  licenseTitle: string;
  category?: string;
}

export interface SelectedIconInfo {
  name: string;
  collectionPrefix: string;
  collectionName: string;
}
