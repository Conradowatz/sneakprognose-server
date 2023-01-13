import {NextFunction, Request, Response} from "express";
import {Movie} from "../entity/Movie";
import {AppDataSource} from "../app-data-source";

export class MovieController {

    private movieRepository = AppDataSource.getRepository(Movie);

    async all(request: Request, response: Response, next: NextFunction) {
        return this.movieRepository.find();
    }

    async one(request: Request, response: Response, next: NextFunction) {
        return this.movieRepository.findOneBy({imdbId: request.params.id});
    }

    async save(request: Request, response: Response, next: NextFunction) {
        return this.movieRepository.save(request.body);
    }

    async remove(request: Request, response: Response, next: NextFunction) {
        let sneakToRemove = await this.movieRepository.findOneBy({imdbId: request.params.id});
        await this.movieRepository.remove(sneakToRemove);
    }

}