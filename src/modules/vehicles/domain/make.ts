export type VehicleType = {
  typeId: number;
  typeName: string;
};

export type Make = {
  makeId: number;
  makeName: string;
  vehicleTypes: VehicleType[];
};

export type MakeSummary = Omit<Make, 'vehicleTypes'>;
