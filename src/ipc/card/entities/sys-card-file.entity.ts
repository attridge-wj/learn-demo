import { Entity, Column, PrimaryGeneratedColumn, OneToOne, JoinColumn } from 'typeorm';
import { BaseIdEntity } from '../../../common/entities/baseId.entities';
import { SysCardBaseEntity } from './sys-card-base.entity';
@Entity('sys_card_file')
export class SysCardFileEntity extends BaseIdEntity {

  @Column({ type: 'text', nullable: false, name: 'card_id' })
  cardId!: string;

  @Column({ type: 'text', nullable: true })
  url!: string;

  @Column({ type: 'text', nullable: true })
  name!: string;

  @Column({ type: 'text', nullable: true })
  content?: any;

  @Column({ type: 'integer', nullable: true })
  fileSize?: number;

  @OneToOne(() => SysCardBaseEntity, card => card.fileInfo)
  @JoinColumn({ name: 'card_id' }) // 显式指定外键列名
  card!: SysCardBaseEntity;
} 