export interface ListingSummary {
  id: string;
  title: string;
  price: number | null;
  location?: string;
  url: string;
  imageUrl?: string;
  createdAt?: string;
}

export interface ListingSeller {
  name?: string;
  type?: "private" | "commercial";
}

export interface Listing {
  id: string;
  url: string;
  title: string;
  description: string;
  price: number | null;
  negotiable?: boolean;
  location?: string;
  seller?: ListingSeller;
  images: string[];
  createdAt?: string;
}
