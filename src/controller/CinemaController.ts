import {AppDataSource} from "../app-data-source";
import {NextFunction, Request, Response} from "express";
import {Cinema} from "../entity/Cinema";

export class CinemaController {

    private cinemaRepository = AppDataSource.getRepository(Cinema);

    async all(request: Request, response: Response, next: NextFunction) {
        return this.cinemaRepository.find();
    }

    async one(request: Request, response: Response, next: NextFunction) {
        return this.cinemaRepository.findOneBy({id: parseInt(request.params.id)});
    }

    async save(request: Request, response: Response, next: NextFunction) {
        return this.cinemaRepository.save(request.body);
    }

    async remove(request: Request, response: Response, next: NextFunction) {
        let cinemaToRemove = await this.cinemaRepository.findOneBy({id: parseInt(request.params.id)});
        await this.cinemaRepository.remove(cinemaToRemove);
    }

}