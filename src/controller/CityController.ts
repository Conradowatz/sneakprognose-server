import {NextFunction, Request, Response} from "express";
import {City} from "../entity/City";
import {AppDataSource} from "../app-data-source";

export class CityController {

    private cityRepository = AppDataSource.getRepository(City);

    async all(request: Request, response: Response, next: NextFunction) {
        return this.cityRepository.find({relations: ["cinemas"]});
    }

    async one(request: Request, response: Response, next: NextFunction) {
        return this.cityRepository.findOneBy({id: parseInt(request.params.id)});
    }

    async save(request: Request, response: Response, next: NextFunction) {
        return this.cityRepository.save(request.body);
    }

    async remove(request: Request, response: Response, next: NextFunction) {
        let cityToRemove = await this.cityRepository.findOneBy({id: parseInt(request.params.id)});
        await this.cityRepository.remove(cityToRemove);
    }

}