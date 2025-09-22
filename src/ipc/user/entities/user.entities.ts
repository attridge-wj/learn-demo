import { Entity, Column } from 'typeorm'
import { BaseEntity } from '../../../common/entities/base.entities'

@Entity('user')
export class UserEntity extends BaseEntity {
  @Column({ type: 'text' })
  username!: string

  @Column({ type: 'text' })
  password!: string
  
  @Column({ type: 'text' })
  email!: string
}
