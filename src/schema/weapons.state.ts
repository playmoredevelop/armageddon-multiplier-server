import { Schema, type, ArraySchema } from '@colyseus/schema'

export enum WeaponStatus {
    inactive, powerup, active
}

export enum WeaponIndex {
    bazooka, shotgun, minigun, handgranade, holygrenade, dynamite, jetpack, drill, ninjarope
}

export const WeaponsMap = new Map([
    [WeaponIndex.bazooka, 15],
    [WeaponIndex.shotgun, 99],
    [WeaponIndex.minigun, 5],
    [WeaponIndex.handgranade, 2],
    [WeaponIndex.holygrenade, 1],
    [WeaponIndex.dynamite, 2],
    [WeaponIndex.jetpack, 1],
    [WeaponIndex.drill, 5],
    [WeaponIndex.ninjarope, 1],
])

export class Weapon extends Schema {

    @type('string') public name: string
    @type('number') public ammo = 0
    @type('number') public angle = 0 // target angle on fire moment

}

export type WeaponSelectedPacket = { select: number }
export type WeaponFirePacket = { impulse: number }

export class WeaponsState extends Schema {

    public allowOff = [WeaponIndex.jetpack, WeaponIndex.ninjarope]

    @type('number') public selectedWeapon = 0 // current weapon id
    @type([Weapon]) public weapons = new ArraySchema<Weapon>()

    @type('number') public status = WeaponStatus.inactive
    @type('number') public impulse = 0

    get isActive(): boolean {
        return this.status === WeaponStatus.active
    }

    get current(): Weapon {
        return this.weapons[this.selectedWeapon]
    }

    public select(id: number): boolean {

        if (this.isActive) return false
        if (id < 0 || id > this.weapons.length - 1) return false
        if (this.weapons[id].ammo <= 0) return false

        this.selectedWeapon = id

        return true
    }

    public fire(impulse: number): boolean {

        if (this.isActive && this.allowOff.includes(this.selectedWeapon)) {
            this.deactivate()
            return false
        }

        if (this.current.ammo <= 0) return false
        
        this.status = WeaponStatus.active
        this.impulse = impulse
        this.current.ammo -= 1

        return true
    }

    public deactivate() {
        this.impulse = 0
        this.status = WeaponStatus.inactive
    }

    public setWeaponsMap(map: Map <WeaponIndex, number> = WeaponsMap): boolean {
        if (map.size === WeaponsMap.size) {
            this.weapons.clear()
            map.forEach(ammo => {
                const weapon = new Weapon()
                weapon.ammo = ammo
                this.weapons.push(weapon)
            })
            return true
        }
        return false
    }
}