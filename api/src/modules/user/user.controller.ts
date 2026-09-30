import { UserService } from "./user.service";
import type { CreateUserDTO, UpdateUserDTO, FilterUserDTO, UserActor } from "@/types/user.type";
import type { PaginationQuery } from "@/types/pagination.type";

export class UserController {
  static async getUsers(data: FilterUserDTO & PaginationQuery) {
    return await UserService.getUsers(data);
  }

  static async getUser(id: string, actor: UserActor) {
    return await UserService.getUser(id, actor);
  }

  static async createUser(data: CreateUserDTO, actor: UserActor) {
    return await UserService.create(data, actor);
  }

  static async updateUser(id: string, data: UpdateUserDTO, actor: UserActor) {
    return await UserService.update(id, data, actor)
  }
  
  static async deleteUsers(ids: string[], actor: UserActor) {
    return await UserService.delete(ids, actor);
  }

  static async deactivateUser(id: string, actor: UserActor) {
    return await UserService.deactivateUser(id, actor);
  }

  static async activateUser(id: string, actor: UserActor) {
    return await UserService.activateUser(id, actor);
  }

}