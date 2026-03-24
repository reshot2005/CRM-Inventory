import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsNotEmpty, IsString, MinLength } from 'class-validator';

export class CreateActivityDto {
  @ApiProperty({
    description: 'Activity type',
    enum: ['NOTE', 'CALL', 'ORDER', 'PAYMENT', 'SYSTEM'],
  })
  @IsString()
  @IsIn(['NOTE', 'CALL', 'ORDER', 'PAYMENT', 'SYSTEM'])
  type: string;

  @ApiProperty({ description: 'Activity content / description' })
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  content: string;
}
