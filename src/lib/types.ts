export type Logo = {
  id: string;
  name: string;
  /** file:// URI of the stored transparent PNG inside the app's documents dir */
  uri: string;
  width: number;
  height: number;
  createdAt: number;
  /** copy of the original picture the logo was made from — used for editing */
  sourceUri?: string;
  /** processing settings used, so editing starts from them */
  options?: { removeBg: boolean; tolerance: number };
};

export type StampedPhoto = {
  id: string;
  /** file:// URI of the stored JPEG inside the app's documents dir */
  uri: string;
  /** URI of the original un-stamped photo, so it can be edited again */
  photoUri?: string;
  width: number;
  height: number;
  createdAt: number;
  /** set while the photo sits in "Recently deleted"; absent when active */
  deletedAt?: number;
};
