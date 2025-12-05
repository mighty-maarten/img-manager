import { Column, Entity } from 'typeorm';
import { BaseEntity } from './base.entity';

@Entity('users')
export class UserEntity extends BaseEntity {
    @Column()
    email!: string;

    @Column({ name: 'password_hash' })
    passwordHash!: string;
}
