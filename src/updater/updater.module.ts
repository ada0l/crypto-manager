import { Module } from '@nestjs/common';
import { UpdaterService } from './updater.service';
import { HttpModule } from '@nestjs/axios';

@Module({
  imports: [HttpModule],
  providers: [UpdaterService],
})
export class UpdaterModule {}
