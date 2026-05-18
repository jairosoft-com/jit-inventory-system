import { Controller } from '@nestjs/common';
import { InventoryService } from './inventory.service';

@Controller('inventory')
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  // TODO: GET /inventory, POST /inventory, PATCH /inventory/:id
  // TODO: POST /inventory/stock-in, POST /inventory/stock-out
}
