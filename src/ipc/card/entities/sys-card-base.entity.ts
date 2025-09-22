import { Column, Entity, PrimaryColumn, Index, OneToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entities'
import { SysCardRichTextEntity } from './sys-card-rich-text.entity'
import { SysCardFileEntity } from './sys-card-file.entity';
import { SysCardDrawboardEntity } from './sys-card-drawboard.entity';
import { SysCardMindMapEntity } from './sys-card-mind-map.entity';
@Entity('sys_card_base')
@Index(['text'])
@Index(['name'])
@Index(['description'])
@Index(['markText'])
@Index(['extraData'])
@Index(['cardType'])
@Index(['subType'])
@Index(['spaceId'])
@Index(['boxId'])
@Index(['createTime'])
@Index(['updateTime'])
@Index(['isCollect'])
@Index(['delFlag'])
@Index(['cardType', 'subType'])
@Index(['spaceId', 'boxId'])
@Index(['delFlag', 'cardType'])
@Index(['delFlag', 'updateTime'])
@Index(['md5'])
export class SysCardBaseEntity extends BaseEntity {
  @Column({ type: 'text', nullable: true, name: 'card_type' })
  cardType!: string;

  @Column({ type: 'text', nullable: true })
  name!: string;

  @Column({ type: 'text', nullable: true, name: 'cover_url' })
  coverUrl!: string;

  @Column({ type: 'integer', nullable: true, name: 'version_num' })
  versionNum!: number;

  @Column({ type: 'integer', nullable: true, default: 1 })
  enabled!: number;

  @Column({ type: 'text', nullable: true })
  text!: string;

  @Column({ type: 'text', nullable: true })
  description!: string;

  @Column({ type: 'text', nullable: true, name: 'space_id' })
  spaceId!: string;

  @Column({ type: 'text', nullable: true, name: 'parent_id' })
  parentId!: string;

  @Column({ type: 'text', nullable: true, name: 'node_id' })
  nodeId!: string;

  @Column({ type: 'text', nullable: true, name: 'tag_ids' })
  tagIds!: string;

  @Column({ type: 'text', nullable: true, name: 'box_id' })
  boxId!: string;

  @Column({ type: 'text', nullable: true })
  url!: string;

  @Column({ type: 'text', nullable: true, name: 'sub_type' })
  subType!: string;

  @Column({ type: 'text', nullable: true, name: 'extra_data' })
  extraData!: any;

  @Column({ type: 'text', nullable: true, name: 'color' })
  color!: string;
  
  @Column({ type: 'text', nullable: true, name: 'local_path' })
  localPath!: string;
  
  @Column({ type: 'text', nullable: true, name: 'flash_id' })
  flashId!: string;

  @Column({ type: 'text', nullable: true, name: 'date' })
  date!: string;

  @Column({ type: 'text', nullable: true, name: 'upload_name' })
  uploadName!: string;

  @Column({ type: 'integer', nullable: true, name: 'mark_number', default: 0 })
  markNumber!: number;

  @Column({ type: 'text', nullable: true, name: 'is_collect', default: '0' })
  isCollect!: string;

  @Column({ type: 'text', nullable: true, name: 'source_id' })
  sourceId!: string;

  @Column({ type: 'text', nullable: true, name: 'mark_text'})
  markText!: string;

  @Column({ type: 'text', nullable: true, name: 'md5' })
  md5!: string;

  @OneToOne(() => SysCardRichTextEntity, cardInfo => cardInfo.card)
  cardInfo!: SysCardRichTextEntity;

  @OneToOne(() => SysCardDrawboardEntity, drawboard => drawboard.card)
  drawboard!: SysCardDrawboardEntity;

  @OneToOne(() => SysCardMindMapEntity, mindMap => mindMap.card)
  mindMap!: SysCardMindMapEntity;

  @OneToOne(() => SysCardFileEntity, fileInfo => fileInfo.card)
  fileInfo!: SysCardFileEntity;
} 