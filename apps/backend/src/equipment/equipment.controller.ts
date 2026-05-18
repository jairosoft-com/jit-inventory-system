import { Controller } from '@nestjs/common';
import { EquipmentService } from './equipment.service';

@Controller('equipment')
export class EquipmentController {
  constructor(private readonly equipmentService: EquipmentService) {}

  // TODO: GET /equipment, GET /equipment/:id, POST /equipment, PATCH /equipment/:id
}
